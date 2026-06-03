#include <unordered_map>
#include "main.hpp"
#include "tag/Tag.hpp"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include "esp_system.h"

Preferences prefs;
Config config;
CB cb;
String MQTT_PUB_TOPIC;
String serial_buffer = "";
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

    if (age > config.interval.uuid_cache_clean_timeout)
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
    if ((now - it->second.getLastSeen()) >= config.interval.tag_timeout)
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

      String url = config.api.url + config.api.uuid_check_endpoint + String("/") + String(ev.uuid);

      http.setTimeout(3000);
      http.setReuse(false);

      if (!http.begin(url))
      {
        Serial.println("Failed HTTP begin.");
        continue;
      }

      int code = http.GET();

      if (code < 0)
      {
        xSemaphoreTake(uuid_mtx, portMAX_DELAY);
        uuid_cache[ev.uuid] = {
            UUIDState::RETRY,
            millis()};

        xSemaphoreGive(uuid_mtx);

        http.end();
        continue;
      }

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
      if (WiFi.status() != WL_CONNECTED)
      {
        vTaskDelay(pdMS_TO_TICKS(1000));
        continue;
      }
      // Serial.printf("MQTT Disconnected. Connecting to %s:%d\n", config.mqtt.host.c_str(), config.mqtt.port);
      if (mqtt.connect(config.dev_name.c_str(), config.mqtt.username.c_str(), config.mqtt.password.c_str()))
        Serial.println("MQTT connected.");
      vTaskDelay(pdMS_TO_TICKS(1000));
    }

    if (xQueueReceive(mqtt_queue, &ev, pdMS_TO_TICKS(100)))
    {
      char payload[128];

      snprintf(payload, sizeof(payload),
               "{\"tagID\":\"%s\",\"rssi\":%.2f}",
               ev.uuid,
               ev.ema);

      bool ok = mqtt.publish(MQTT_PUB_TOPIC.c_str(), payload);

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

  if (it == uuid_cache.end() || (it->second.state == UUIDState::RETRY))
  {
    uuid_cache[event.uuid] = {UUIDState::PENDING, now};

    xSemaphoreGive(uuid_mtx);

    HttpEvent he;

    strlcpy(he.uuid, event.uuid, sizeof(event.uuid));
    xQueueSend(http_queue, &he, 0);

    return;
  }

  if (it->second.state == UUIDState::INVALID &&
      now - it->second.last_check > config.interval.uuid_cache_retry_timeout)
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
  const String name(d->getName().c_str());

  if ((uuid.bitSize() != 128) || (name != config.tag_name))
    return;

  BleEvent event;

  strlcpy(event.uuid, uuid.toString().c_str(), sizeof(event.uuid));
  event.rssi = d->getRSSI();

  xQueueSend(ble_queue, &event, pdMS_TO_TICKS(5));
}

void saveConfig()
{
  prefs.begin("config", false);

  prefs.putUInt(CLEANUP_INTERVAL_CONFIG_KEY, config.interval.cleanup);
  prefs.putUInt(TAG_TIMEOUT_CONFIG_KEY, config.interval.tag_timeout);
  prefs.putUInt(UUID_CACHE_RETRY_TIMEOUT_CONFIG_KEY, config.interval.uuid_cache_retry_timeout);
  prefs.putUInt(UUID_CACHE_CLEAN_TIMEOUT_CONFIG_KEY, config.interval.uuid_cache_clean_timeout);

  prefs.putString(API_URL_CONFIG_KEY, config.api.url);
  prefs.putString(UUID_CHECK_ENDPOINT_CONFIG_KEY, config.api.uuid_check_endpoint);

  prefs.putString(MQTT_HOST_CONFIG_KEY, config.mqtt.host);
  prefs.putUShort(MQTT_PORT_CONFIG_KEY, config.mqtt.port);
  prefs.putString(MQTT_USER_CONFIG_KEY, config.mqtt.username);
  prefs.putString(MQTT_PASS_CONFIG_KEY, config.mqtt.password);
  prefs.putString(MQTT_TOPIC_CONFIG_KEY, config.mqtt.topic);

  prefs.putString(WIFI_SSID_CONFIG_KEY, config.wifi.ssid);
  prefs.putString(WIFI_PASS_CONFIG_KEY, config.wifi.password);
  prefs.putString(WIFI_IP_CONFIG_KEY, config.wifi.ip);
  prefs.putString(WIFI_GW_CONFIG_KEY, config.wifi.gateway);
  prefs.putString(WIFI_SUBNET_CONFIG_KEY, config.wifi.subnet);

  prefs.putString(DEV_NAME_CONFIG_KEY, config.dev_name);
  prefs.putString(TAG_NAME_CONFIG_KEY, config.tag_name);

  prefs.end();
}

void loadConfig()
{
  prefs.begin("config", true);

  config.interval.cleanup = prefs.getUInt(CLEANUP_INTERVAL_CONFIG_KEY, CLEANUP_INTERVAL);
  config.interval.tag_timeout = prefs.getUInt(TAG_TIMEOUT_CONFIG_KEY, TAG_TIMEOUT);
  config.interval.uuid_cache_retry_timeout = prefs.getUInt(UUID_CACHE_RETRY_TIMEOUT_CONFIG_KEY, UUID_CACHE_RETRY_TIMEOUT);
  config.interval.uuid_cache_clean_timeout = prefs.getUInt(UUID_CACHE_CLEAN_TIMEOUT_CONFIG_KEY, UUID_CACHE_CLEAN_TIMEOUT);

  config.api.url = prefs.getString(API_URL_CONFIG_KEY, API_URL);
  config.api.uuid_check_endpoint = prefs.getString(UUID_CHECK_ENDPOINT_CONFIG_KEY, UUID_CHECK_ENDPOINT);

  config.mqtt.host = prefs.getString(MQTT_HOST_CONFIG_KEY, MQTT_HOST);
  config.mqtt.port = prefs.getUShort(MQTT_PORT_CONFIG_KEY, MQTT_PORT);
  config.mqtt.username = prefs.getString(MQTT_USER_CONFIG_KEY, MQTT_USER);
  config.mqtt.password = prefs.getString(MQTT_PASS_CONFIG_KEY, MQTT_PASS);
  config.mqtt.topic = prefs.getString(MQTT_TOPIC_CONFIG_KEY, MQTT_TOPIC);

  config.wifi.ssid = prefs.getString(WIFI_SSID_CONFIG_KEY, WIFI_SSID);
  config.wifi.password = prefs.getString(WIFI_PASS_CONFIG_KEY, WIFI_PASS);
  config.wifi.ip = prefs.getString(WIFI_IP_CONFIG_KEY, WIFI_IP);
  config.wifi.gateway = prefs.getString(WIFI_GW_CONFIG_KEY, WIFI_GW);
  config.wifi.subnet = prefs.getString(WIFI_SUBNET_CONFIG_KEY, WIFI_SUBNET);

  config.dev_name = prefs.getString(DEV_NAME_CONFIG_KEY, DEV_NAME);
  config.tag_name = prefs.getString(TAG_NAME_CONFIG_KEY, TAG_NAME);

  prefs.end();
}

void handleCommand(String line)
{
  if (line.startsWith("set "))
  {
    int p1 = line.indexOf(' ', 4);
    String key = line.substring(4, p1);
    String value = line.substring(p1 + 1);

    if (key.length() == 0 || value.length() == 0)
      return;

    if (key == CLEANUP_INTERVAL_CONFIG_KEY)
      config.interval.cleanup = (uint32_t)value.toInt();
    else if (key == TAG_TIMEOUT_CONFIG_KEY)
      config.interval.tag_timeout = (uint32_t)value.toInt();
    else if (key == UUID_CACHE_RETRY_TIMEOUT_CONFIG_KEY)
      config.interval.uuid_cache_retry_timeout = (uint32_t)value.toInt();
    else if (key == UUID_CACHE_CLEAN_TIMEOUT_CONFIG_KEY)
      config.interval.uuid_cache_clean_timeout = (uint32_t)value.toInt();
    else if (key == API_URL_CONFIG_KEY)
      config.api.url = value;
    else if (key == UUID_CHECK_ENDPOINT_CONFIG_KEY)
      config.api.uuid_check_endpoint = value;
    else if (key == MQTT_HOST_CONFIG_KEY)
      config.mqtt.host = value;
    else if (key == MQTT_PORT_CONFIG_KEY)
      config.mqtt.port = value.toInt();
    else if (key == MQTT_USER_CONFIG_KEY)
      config.mqtt.username = value;
    else if (key == MQTT_PASS_CONFIG_KEY)
      config.mqtt.password = value;
    else if (key == MQTT_TOPIC_CONFIG_KEY)
      config.mqtt.topic = value;
    else if (key == WIFI_SSID_CONFIG_KEY)
      config.wifi.ssid = value;
    else if (key == WIFI_PASS_CONFIG_KEY)
      config.wifi.password = value;
    else if (key == WIFI_IP_CONFIG_KEY)
      config.wifi.ip = value;
    else if (key == WIFI_GW_CONFIG_KEY)
      config.wifi.gateway = value;
    else if (key == WIFI_SUBNET_CONFIG_KEY)
      config.wifi.subnet = value;
    else if (key == DEV_NAME_CONFIG_KEY)
      config.dev_name = value;
    else if (key == TAG_NAME_CONFIG_KEY)
      config.tag_name = value;
  }
  else if (line == "save")
    saveConfig();
  else if (line.startsWith("show "))
  {
    String key = line.substring(5);

    if (key.length() == 0)
      return;

    if (key == CLEANUP_INTERVAL_CONFIG_KEY)
      Serial.println(config.interval.cleanup);
    else if (key == TAG_TIMEOUT_CONFIG_KEY)
      Serial.println(config.interval.tag_timeout);
    else if (key == UUID_CACHE_RETRY_TIMEOUT_CONFIG_KEY)
      Serial.println(config.interval.uuid_cache_retry_timeout);
    else if (key == UUID_CACHE_CLEAN_TIMEOUT_CONFIG_KEY)
      Serial.println(config.interval.uuid_cache_clean_timeout);
    else if (key == API_URL_CONFIG_KEY)
      Serial.println(config.api.url);
    else if (key == UUID_CHECK_ENDPOINT_CONFIG_KEY)
      Serial.println(config.api.uuid_check_endpoint);
    else if (key == MQTT_HOST_CONFIG_KEY)
      Serial.println(config.mqtt.host);
    else if (key == MQTT_PORT_CONFIG_KEY)
      Serial.println(config.mqtt.port);
    else if (key == MQTT_USER_CONFIG_KEY)
      Serial.println(config.mqtt.username);
    else if (key == MQTT_PASS_CONFIG_KEY)
      Serial.println(config.mqtt.password);
    else if (key == MQTT_TOPIC_CONFIG_KEY)
      Serial.println(config.mqtt.topic);
    else if (key == WIFI_SSID_CONFIG_KEY)
      Serial.println(config.wifi.ssid);
    else if (key == WIFI_PASS_CONFIG_KEY)
      Serial.println(config.wifi.password);
    else if (key == WIFI_IP_CONFIG_KEY)
      Serial.println(config.wifi.ip);
    else if (key == WIFI_GW_CONFIG_KEY)
      Serial.println(config.wifi.gateway);
    else if (key == WIFI_SUBNET_CONFIG_KEY)
      Serial.println(config.wifi.subnet);
    else if (key == DEV_NAME_CONFIG_KEY)
      Serial.println(config.dev_name);
    else if (key == TAG_NAME_CONFIG_KEY)
      Serial.println(config.tag_name);
  }
  else if (line == "reset")
  {
    prefs.begin("config", false);
    prefs.clear();
    prefs.end();

    esp_restart();
  }
  else if (line == "reboot")
  {
    Serial.println("Rebooting...");
    Serial.flush();
    esp_restart();
  }
  else if (line == "help")
  {
    Serial.println("Commands:");
    Serial.println("  set <key> <value>   - Set a configuration value");
    Serial.println("  show <key>          - Show a configuration value");
    Serial.println("    <key>:");
    Serial.println("      int.cln");
    Serial.println("      int.tagto");
    Serial.println("      int.urtry");
    Serial.println("      int.ucclean");
    Serial.println("      api.url");
    Serial.println("      api.uuidchk");
    Serial.println("      mq.host");
    Serial.println("      mq.port");
    Serial.println("      mq.user");
    Serial.println("      mq.pass");
    Serial.println("      mq.topic");
    Serial.println("      wf.ssid");
    Serial.println("      wf.pass");
    Serial.println("      wf.ip");
    Serial.println("      wf.gw");
    Serial.println("      wf.subnet");
    Serial.println("      dev.name");
    Serial.println("      tag.name");
    Serial.println("  save                - Save configuration to non-volatile storage");
    Serial.println("  reset               - Reset configuration to defaults");
    Serial.println("  reboot              - Reboot the device");
    Serial.println("  help                - Show this help message");
  }
}

void wifiBegin()
{
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  IPAddress local_ip, gateway, subnet;
  local_ip.fromString(config.wifi.ip);

  if (local_ip != IPAddress(0, 0, 0, 0))
  {
    gateway.fromString(config.wifi.gateway);
    subnet.fromString(config.wifi.subnet);
    WiFi.config(local_ip, gateway, subnet);
  }

  WiFi.begin(config.wifi.ssid.c_str(), config.wifi.password.c_str());
}

void setup()
{
  Serial.begin(115200);

  loadConfig();

  WiFi.onEvent([](WiFiEvent_t event, WiFiEventInfo_t info)
               {
  switch (event)
  {
    case ARDUINO_EVENT_WIFI_STA_CONNECTED:
      Serial.println("WiFi connected.");
      break;
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      Serial.printf("WiFi disconnected, reason: %d\n", info.wifi_sta_disconnected.reason);
      break;
  } });

  wifiBegin();

  MQTT_PUB_TOPIC = config.mqtt.topic + config.dev_name;

  mqtt.setServer(config.mqtt.host.c_str(), config.mqtt.port);
  mqtt.setKeepAlive(60);
  mqtt.setSocketTimeout(5);

  ble_queue = xQueueCreate(100, sizeof(BleEvent));
  mqtt_queue = xQueueCreate(100, sizeof(NetEvent));
  http_queue = xQueueCreate(100, sizeof(HttpEvent));

  uuid_mtx = xSemaphoreCreateMutex();

  xTaskCreatePinnedToCore(mqttTask, "mqtt", 4096, NULL, 1, NULL, 1);
  xTaskCreatePinnedToCore(httpTask, "http", 4096, NULL, 1, NULL, 1);

  NimBLEDevice::init(config.dev_name.c_str());

  NimBLEScan *scan = NimBLEDevice::getScan();

  scan->setScanCallbacks(&cb);
  scan->setActiveScan(false);
  scan->setDuplicateFilter(false);

  scan->start(0, false, true);
}

void loop()
{
  BleEvent ev;
  static uint32_t last_wifi_check = 0;

  if (millis() - last_wifi_check >= WIFI_TEST_INTERVAL)
  {
    last_wifi_check = millis();

    wl_status_t status = WiFi.status();

    if (status == WL_CONNECT_FAILED || status == WL_NO_SSID_AVAIL)
    {
      Serial.printf("WiFi failed (status %d), retrying...\n", status);
      WiFi.disconnect();
      delay(100);
      wifiBegin();
    }
  }

  while (xQueueReceive(ble_queue, &ev, 0))
    processEvent(ev);

  static uint32_t last_cleanup = 0;

  if (millis() - last_cleanup >= config.interval.cleanup)
  {
    cleanupTags();
    cleanupCache();
    last_cleanup = millis();
  }

  while (Serial.available())
  {
    char c = Serial.read();

    if (c == '\r')
      continue;

    if (c == '\n')
    {
      Serial.print(c);
      serial_buffer.trim();

      if (serial_buffer.length() > 0)
        handleCommand(serial_buffer);

      serial_buffer = "";

      Serial.printf("%s> ", config.dev_name.c_str());
    }
    else if (c == '\b')
    {
      if (serial_buffer.length() > 0)
      {
        serial_buffer.remove(serial_buffer.length() - 1);

        Serial.print("\b \b");
      }
    }
    else
    {
      Serial.print(c);
      serial_buffer += c;
    }
  }
}
