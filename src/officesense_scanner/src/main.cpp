#include <unordered_map>
#include "main.hpp"
#include "tag/Tag.hpp"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include <HTTPClient.h>
#include <PubSubClient.h>

CB cb;
char MQTT_PUB_TOPIC[sizeof(MQTT_TOPIC) + sizeof(DEV_NAME) - 1];
std::unordered_map<std::string, Tag> tags;
std::unordered_map<std::string, UUIDCacheEntry> uuid_cache;
SemaphoreHandle_t uuid_mtx;
QueueHandle_t ble_queue;
QueueHandle_t mqtt_queue;
QueueHandle_t http_queue;
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

void cleanupCache()
{
  uint32_t now = millis();

  xSemaphoreTake(uuid_mtx, portMAX_DELAY);

  for (auto it = uuid_cache.begin(); it != uuid_cache.end();)
  {
    uint32_t age = now - it->second.last_check;

    if (age > UUID_CACHE_CLEAN_TIMEOUT)
    {
      Serial.printf("Erasing %s from cache after being inactive for %dms.\n",
                    it->first.c_str(),
                    age);
      it = uuid_cache.erase(it);
    }
    else
      ++it;
  }

  xSemaphoreGive(uuid_mtx);
}

void cleanupTags()
{
  uint32_t now = millis();

  for (auto it = tags.begin(); it != tags.end();)
  {
    if ((now - it->second.getLastSeen()) >= TAG_TIMEOUT)
    {
      Serial.printf("Erasing %s from memory after being inactive for %dms.\n",
                    it->first.c_str(),
                    now - it->second.getLastSeen());
      it = tags.erase(it);
    }
    else
      ++it;
  }
}

void httpTask(void *)
{
  HttpEvent ev;

  while (true)
  {
    if (xQueueReceive(http_queue, &ev, portMAX_DELAY))
    {
      HTTPClient http;

      String url = UUID_CHECK_ENDPOINT + String(ev.uuid);

      http.setTimeout(3000);
      http.setReuse(false);

      if (!http.begin(url))
      {
        Serial.println("Failed HTTP begin.");
        continue;
      }

      int code = http.GET();

      bool valid = (code == 200);

      http.end();

      xSemaphoreTake(uuid_mtx, portMAX_DELAY);
      uuid_cache[ev.uuid] = {
          (valid) ? UUIDState::VALID : UUIDState::INVALID,
          millis()};

#ifdef DEBUG
      Serial.printf("[%s] is now marked as %s\n", ev.uuid, (valid) ? "valid" : "invalid");
#endif

      xSemaphoreGive(uuid_mtx);
    }

    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

void mqttTask(void *)
{
  NetEvent ev;

  while (true)
  {
    while (!mqtt.connected())
    {
      Serial.printf("MQTT Disconnected. Connecting to %s:%d\n", MQTT_HOST, MQTT_PORT);
      if (mqtt.connect(DEV_NAME, MQTT_USER, MQTT_PASS))
        Serial.println("MQTT connected.");
      vTaskDelay(pdMS_TO_TICKS(1000));
    }

    if (xQueueReceive(mqtt_queue, &ev, pdMS_TO_TICKS(100)))
    {
      char payload[128];

      snprintf(payload, sizeof(payload),
               "{\"uuid\":\"%s\",\"rssi\":%.2f}",
               ev.uuid,
               ev.ema);

      bool ok = mqtt.publish(MQTT_PUB_TOPIC, payload);

      if (!ok)
        Serial.println("Failed to publish on MQTT.");
    }
    else
      mqtt.loop();
  }
}

void processEvent(const BleEvent &event)
{
  xSemaphoreTake(uuid_mtx, portMAX_DELAY);

  auto it = uuid_cache.find(event.uuid);

  uint32_t now = millis();

  if (it == uuid_cache.end())
  {
    uuid_cache[event.uuid] = {UUIDState::PENDING, now};

    xSemaphoreGive(uuid_mtx);

    HttpEvent he;

    strlcpy(he.uuid, event.uuid, sizeof(event.uuid));
    xQueueSend(http_queue, &he, 0);

    return;
  }

  if (it->second.state == UUIDState::INVALID &&
      now - it->second.last_check > UUID_CACHE_RETRY_TIMEOUT)
  {
    it->second.state = UUIDState::PENDING;
    it->second.last_check = now;

    xSemaphoreGive(uuid_mtx);

    HttpEvent he;

    strlcpy(he.uuid, event.uuid, sizeof(event.uuid));
    xQueueSend(http_queue, &he, 0);

    return;
  }

  UUIDState state = it->second.state;

  xSemaphoreGive(uuid_mtx);

  if (state != UUIDState::VALID)
    return;

  Tag &tag = tags[event.uuid];

  tag.addSample(event.rssi);

  if (tag.shouldPublish())
  {
    NetEvent ne;

    strlcpy(ne.uuid, event.uuid, sizeof(event.uuid));
    ne.ema = tag.getEMA();

    if (!xQueueSend(mqtt_queue, &ne, 0))
      Serial.println("Failed to send MQTT data over MQTT Queue.");
  }
}

void CB::onResult(const NimBLEAdvertisedDevice *d)
{
  if (!d->haveServiceUUID() || !d->haveName())
    return;

  NimBLEUUID uuid = d->getServiceUUID(0);
  const std::string &name = d->getName();

  if ((uuid.bitSize() != 128) || (name != TAG_NAME))
    return;

  BleEvent event;

  strlcpy(event.uuid, uuid.toString().c_str(), sizeof(event.uuid));
  event.rssi = d->getRSSI();

  xQueueSend(ble_queue, &event, pdMS_TO_TICKS(5));
}

void setup()
{
  Serial.begin(115200);

  WiFi.begin(WIFI_SSID, WIFI_PASS);

  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected");

  snprintf(MQTT_PUB_TOPIC, sizeof(MQTT_PUB_TOPIC), "%s%s", MQTT_TOPIC, DEV_NAME);

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setKeepAlive(60);
  mqtt.setSocketTimeout(5);

  ble_queue = xQueueCreate(100, sizeof(BleEvent));
  mqtt_queue = xQueueCreate(100, sizeof(NetEvent));
  http_queue = xQueueCreate(100, sizeof(HttpEvent));

  uuid_mtx = xSemaphoreCreateMutex();

  xTaskCreatePinnedToCore(mqttTask, "mqtt", 4096, NULL, 1, NULL, 1);
  xTaskCreatePinnedToCore(httpTask, "http", 4096, NULL, 1, NULL, 1);

  NimBLEDevice::init(DEV_NAME);

  NimBLEScan *scan = NimBLEDevice::getScan();

  scan->setScanCallbacks(&cb);
  scan->setActiveScan(false);
  scan->setDuplicateFilter(false);

  scan->start(0, false, true);
}

void loop()
{
  BleEvent ev;

  while (xQueueReceive(ble_queue, &ev, 0))
    processEvent(ev);

  static uint32_t last_cleanup = 0;

  if (millis() - last_cleanup >= CLEANUP_INTERVAL)
  {
    cleanupTags();
    cleanupCache();
    last_cleanup = millis();
  }
}
