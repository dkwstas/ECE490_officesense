#ifndef MAIN_H
#define MAIN_H

#include "host/ble_hs.h"

#define DEFAULT_UUID "12345678-9abc-def0-1234-56789abcdef0"
#define DEFAULT_NAME "X6TAG"
#define DEFAULT_ADV_INTERVAL 800

typedef struct
{
    ble_uuid128_t uuid;
    char uuid_str[37];
    char name[32];
    uint16_t adv_interval;
} config_t;

#endif