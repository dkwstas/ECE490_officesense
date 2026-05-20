#include <stdio.h>
#include <string.h>
#include "nvs_flash.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "services/gap/ble_svc_gap.h"
#include "driver/usb_serial_jtag.h"
#include "main.h"

static config_t config;

static void start_adv(void)
{
    struct ble_hs_adv_fields fields;
    memset(&fields, 0, sizeof(fields));

    fields.flags = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;

    fields.name = (uint8_t *)config.name;
    fields.name_len = strlen(config.name);
    fields.name_is_complete = 1;

    fields.uuids128 = (ble_uuid128_t *)&config.uuid;
    fields.num_uuids128 = 1;
    fields.uuids128_is_complete = 1;

    int rc = ble_gap_adv_set_fields(&fields);
    if (rc != 0)
    {
        ESP_LOGE(config.name, "adv set fields failed: %d", rc);
        return;
    }

    struct ble_gap_adv_params params;
    memset(&params, 0, sizeof(params));

    params.conn_mode = BLE_GAP_CONN_MODE_NON;
    params.disc_mode = BLE_GAP_DISC_MODE_GEN;
    params.itvl_min = 0x80; // ~100ms
    params.itvl_max = 0x80;

    rc = ble_gap_adv_start(
        BLE_ADDR_PUBLIC,
        NULL,
        BLE_HS_FOREVER,
        &params,
        NULL,
        NULL);

    if (rc != 0)
    {
        ESP_LOGE(config.name, "adv start failed: %d", rc);
    }
    else
    {
        ESP_LOGI(config.name, "advertising started");
    }
}

static void on_sync(void)
{
    ESP_LOGI(config.name, "BLE synced");

    start_adv();
}

static void host_task(void *param)
{
    nimble_port_run();
}

static bool uuid_from_string(const char *str, ble_uuid128_t *uuid)
{
    unsigned int b[16];

    int rc = sscanf(str,
                    "%02x%02x%02x%02x-"
                    "%02x%02x-"
                    "%02x%02x-"
                    "%02x%02x-"
                    "%02x%02x%02x%02x%02x%02x",

                    &b[15], &b[14], &b[13], &b[12],
                    &b[11], &b[10],
                    &b[9], &b[8],
                    &b[7], &b[6],
                    &b[5], &b[4], &b[3],
                    &b[2], &b[1], &b[0]);

    if (rc != 16)
        return false;

    uuid->u.type = BLE_UUID_TYPE_128;

    for (int i = 0; i < 16; i++)
        uuid->value[i] = (uint8_t)b[i];

    return true;
}

static esp_err_t reset_config()
{
    nvs_handle_t nvs;

    esp_err_t err = nvs_open("config", NVS_READWRITE, &nvs);

    if (err != ESP_OK)
        return err;

    err = nvs_erase_all(nvs);

    if (err != ESP_OK)
        goto exit;

    err = nvs_commit(nvs);

exit:
    nvs_close(nvs);

    return err;
}

static esp_err_t save_config()
{
    nvs_handle_t nvs;

    esp_err_t err = nvs_open("config", NVS_READWRITE, &nvs);

    if (err != ESP_OK)
        return err;

    err = nvs_set_str(nvs, "uuid", config.uuid_str);

    if (err != ESP_OK)
        goto exit;

    err = nvs_set_str(nvs, "name", config.name);

    if (err != ESP_OK)
        goto exit;

    err = nvs_set_u32(nvs, "adv_int", config.adv_interval);

    if (err != ESP_OK)
        goto exit;

    err = nvs_commit(nvs);

exit:
    nvs_close(nvs);

    return err;
}

static esp_err_t load_config()
{
    nvs_handle_t nvs;

    esp_err_t err = nvs_open("config", NVS_READONLY, &nvs);

    strcpy(config.uuid_str, DEFAULT_UUID);
    strcpy(config.name, DEFAULT_NAME);
    config.adv_interval = DEFAULT_ADV_INTERVAL;

    uuid_from_string(config.uuid_str, &config.uuid);

    if (err != ESP_OK)
        return err;

    size_t len;

    len = sizeof(config.uuid_str);

    nvs_get_str(nvs, "uuid", config.uuid_str, &len);

    len = sizeof(config.name);

    nvs_get_str(nvs, "name", config.name, &len);

    nvs_get_u32(nvs, "adv_int", &config.adv_interval);

    nvs_close(nvs);

    uuid_from_string(config.uuid_str, &config.uuid);

    return ESP_OK;
}

void serial_task(void *arg)
{
    char line[128];
    char buf[64];
    int pos = 0;

    while (1)
    {
        uint8_t ch;

        int len = usb_serial_jtag_read_bytes(&ch, 1, portMAX_DELAY);

        if (len > 0)
        {
            if (ch == '\n' || ch == '\r')
            {
                usb_serial_jtag_write_bytes("\n", 1, 20 / portTICK_PERIOD_MS);
                line[pos] = '\0';

                if (pos > 0)
                {
                    if (strncmp(line, "set uuid ", 9) == 0)
                    {
                        if (uuid_from_string(line + 9, &config.uuid))
                            strcpy(config.uuid_str, line + 9);
                    }
                    else if (strncmp(line, "set name ", 9) == 0)
                    {
                        strncpy(config.name, line + 9, sizeof(config.name) - 1);
                        config.name[sizeof(config.name) - 1] = '\0';
                    }
                    else if (strncmp(line, "set adv_interval ", 17) == 0)
                    {
                        uint32_t interval = atoi(line + 17);
                        if (interval > 0)
                            config.adv_interval = interval;
                    }
                    else if (strcmp(line, "show uuid") == 0)
                    {
                        usb_serial_jtag_write_bytes(config.uuid_str, strlen(config.uuid_str), 20 / portTICK_PERIOD_MS);
                        usb_serial_jtag_write_bytes("\n", 1, 20 / portTICK_PERIOD_MS);
                    }
                    else if (strcmp(line, "show name") == 0)
                    {
                        usb_serial_jtag_write_bytes(config.name, strlen(config.name), 20 / portTICK_PERIOD_MS);
                        usb_serial_jtag_write_bytes("\n", 1, 20 / portTICK_PERIOD_MS);
                    }
                    else if (strcmp(line, "show adv_interval") == 0)
                    {
                        int len = snprintf(buf, sizeof(buf), "%lu\n", (unsigned long)config.adv_interval);
                        usb_serial_jtag_write_bytes(buf, len, 20 / portTICK_PERIOD_MS);
                    }
                    else if (strcmp(line, "save") == 0)
                        save_config();
                    else if (strcmp(line, "reset") == 0)
                    {
                        reset_config();
                        esp_restart();
                    }
                    else if (strcmp(line, "reboot") == 0)
                    {
                        usb_serial_jtag_write_bytes("Rebooting...\n", 13, 20 / portTICK_PERIOD_MS);
                        esp_restart();
                    }
                    else if (strcmp(line, "help") == 0)
                    {
                        usb_serial_jtag_write_bytes("Commands:\n"
                                                    "  set uuid <uuid>\n"
                                                    "  set name <name>\n"
                                                    "  set adv_interval <ms>\n"
                                                    "  show uuid\n"
                                                    "  show name\n"
                                                    "  show adv_interval\n"
                                                    "  save\n"
                                                    "  reset\n"
                                                    "  reboot\n"
                                                    "  help\n",
                                                    145, 20 / portTICK_PERIOD_MS);
                    }
                }

                pos = 0;
                int len = snprintf(buf, sizeof(buf), "%s> ", config.name);
                usb_serial_jtag_write_bytes(buf, len, 20 / portTICK_PERIOD_MS);
            }
            else if (ch == 0x08)
            {
                if (pos > 0)
                {
                    pos--;
                    usb_serial_jtag_write_bytes("\b \b", 3, 20 / portTICK_PERIOD_MS);
                }
            }
            else
            {
                if (pos < sizeof(line) - 1)
                {
                    line[pos++] = ch;
                    usb_serial_jtag_write_bytes((char *)&ch, 1, 20 / portTICK_PERIOD_MS);
                }
            }
        }
    }
}

void app_main(void)
{
    ESP_ERROR_CHECK(nvs_flash_init());

    usb_serial_jtag_driver_config_t cfg = USB_SERIAL_JTAG_DRIVER_CONFIG_DEFAULT();
    usb_serial_jtag_driver_install(&cfg);

    load_config();

    nimble_port_init();

    ble_svc_gap_init();
    ble_svc_gap_device_name_set("X6TAG");

    ble_hs_cfg.sync_cb = on_sync;

    xTaskCreate(
        serial_task,
        "serial_task",
        4096,
        NULL,
        5,
        NULL);

    nimble_port_freertos_init(host_task);
}
