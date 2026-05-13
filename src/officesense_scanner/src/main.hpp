#ifndef MAIN_HPP
#define MAIN_HPP

#include <Arduino.h>
#include <NimBLEDevice.h>
#include <string>

#define CLEANUP_INTERVAL 5 * 1000 // ms
#define TAG_TIMEOUT 60 * 1000 // ms
#define UUID_CACHE_RETRY_TIMEOUT 5 * 60 * 1000 // ms
#define UUID_CACHE_CLEAN_TIMEOUT 60 * 60 * 1000 // ms
#define TAG_NAME "X6TAG"
#define UUID_CHECK_ENDPOINT "http://192.168.1.2/check/"
#define MQTT_HOST "192.168.1.2"
#define MQTT_PORT 1883
#define MQTT_USER "user"
#define MQTT_PASS "pass"
#define MQTT_TOPIC "scanners/"
#define WIFI_SSID "COSMOTE-489882"
#define WIFI_PASS "x32hbh54673ngccdsfa9"
#define DEV_NAME "Scanner_Room_A"

struct BleEvent
{
    char uuid[37];
    int8_t rssi;
};

struct NetEvent
{
    char uuid[37];
    float ema;
};

struct HttpEvent
{
    char uuid[37];
};

enum class UUIDState
{
    PENDING,
    VALID,
    INVALID
};

struct UUIDCacheEntry
{
    UUIDState state;
    uint32_t last_check;
};

class CB : public NimBLEScanCallbacks
{
public:
    void onResult(const NimBLEAdvertisedDevice *d) override;
};

#endif
