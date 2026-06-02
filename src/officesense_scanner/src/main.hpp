#ifndef MAIN_HPP
#define MAIN_HPP

#include <Arduino.h>
#include <NimBLEDevice.h>
#include <string>

#define CLEANUP_INTERVAL_CONFIG_KEY "int.cln"
#define TAG_TIMEOUT_CONFIG_KEY "int.tagto"
#define UUID_CACHE_RETRY_TIMEOUT_CONFIG_KEY "int.urtry"
#define UUID_CACHE_CLEAN_TIMEOUT_CONFIG_KEY "int.ucclean"
#define API_URL_CONFIG_KEY "api.url"
#define UUID_CHECK_ENDPOINT_CONFIG_KEY "api.uuidchk"
#define MQTT_HOST_CONFIG_KEY "mq.host"
#define MQTT_PORT_CONFIG_KEY "mq.port"
#define MQTT_USER_CONFIG_KEY "mq.user"
#define MQTT_PASS_CONFIG_KEY "mq.pass"
#define MQTT_TOPIC_CONFIG_KEY "mq.topic"
#define WIFI_SSID_CONFIG_KEY "wf.ssid"
#define WIFI_PASS_CONFIG_KEY "wf.pass"
#define DEV_NAME_CONFIG_KEY "dev.name"
#define TAG_NAME_CONFIG_KEY "tag.name"

#define CLEANUP_INTERVAL 5 * 1000               // ms
#define TAG_TIMEOUT 60 * 1000                   // ms
#define UUID_CACHE_RETRY_TIMEOUT 5 * 60 * 1000  // ms
#define UUID_CACHE_CLEAN_TIMEOUT 60 * 60 * 1000 // ms
#define API_URL "http://192.168.1.2"
#define UUID_CHECK_ENDPOINT "/lookup/check"
#define TAG_NAME "X6TAG"
#define MQTT_HOST "192.168.1.2"
#define MQTT_PORT 1883
#define MQTT_USER "user"
#define MQTT_PASS "pass"
#define MQTT_TOPIC "scanners/"
#define WIFI_SSID "COSMOTE-489882"
#define WIFI_PASS "x32hbh54673ngccdsfa9"
#define DEV_NAME "572b29cb-6a93-480e-adf0-c5c44e9a58df"

struct Config
{
    struct Interval
    {
        uint32_t cleanup;
        uint32_t tag_timeout;
        uint32_t uuid_cache_retry_timeout;
        uint32_t uuid_cache_clean_timeout;
    } interval;

    struct API
    {
        String url;
        String uuid_check_endpoint;
    } api;

    struct MQTT
    {
        String host;
        uint16_t port;
        String username;
        String password;
        String topic;
    } mqtt;

    struct WiFi
    {
        String ssid;
        String password;
    } wifi;

    String dev_name;
    String tag_name;
};

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
    RETRY,
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
