#include <stdio.h>
#include <string.h>
#include "nvs_flash.h"

#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"

#include "host/ble_hs.h"
#include "services/gap/ble_svc_gap.h"

static const char *TAG = "BLE";

static const ble_uuid128_t service_uuid =
    BLE_UUID128_INIT(
        0xF0, 0xDE, 0xBC, 0x9A,
        0x78, 0x56, 0x34, 0x12,
        0xF0, 0xDE, 0xBC, 0x9A,
        0x78, 0x56, 0x34, 0x12);

static void start_adv(void)
{
    struct ble_hs_adv_fields fields;
    memset(&fields, 0, sizeof(fields));

    fields.flags = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;

    fields.uuids128 = (ble_uuid128_t *)&service_uuid;
    fields.num_uuids128 = 1;
    fields.uuids128_is_complete = 1;

    uint8_t mfg_data[5] = {0x34, 0x34, 0x34, 0x34, 0x34};

    fields.mfg_data = mfg_data;
    fields.mfg_data_len = sizeof(mfg_data);

    int rc = ble_gap_adv_set_fields(&fields);
    if (rc != 0)
    {
        ESP_LOGE(TAG, "adv set fields failed: %d", rc);
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
        ESP_LOGE(TAG, "adv start failed: %d", rc);
    }
    else
    {
        ESP_LOGI(TAG, "advertising started");
    }
}

static void on_sync(void)
{
    ESP_LOGI(TAG, "BLE synced");

    start_adv();
}

static void host_task(void *param)
{
    nimble_port_run();
}

void app_main(void)
{
    ESP_ERROR_CHECK(nvs_flash_init());
    nimble_port_init();

    ble_svc_gap_init();
    ble_svc_gap_device_name_set("XIAO_C6");

    ble_hs_cfg.sync_cb = on_sync;

    nimble_port_freertos_init(host_task);
}
