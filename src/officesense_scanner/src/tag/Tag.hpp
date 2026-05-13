#ifndef TAG_HPP
#define TAG_HPP

#include <Arduino.h>

/*
 * EMA_THRESHOLD Options:
 * 1   - High Sensitivity / Fine Tracking
 * 2   - Static Object / Presence Detection
 * 3   - General Tracking (Default)
 * 4-5 - Noisy Environment / Interference
 */
#define EMA_THRESHOLD 3
#define INTERVAL 5000 // ms
#define WINDOW_SIZE 5
// #define DEBUG 1

class Tag
{
private:
    int8_t rssi_window[WINDOW_SIZE];
    uint8_t win_idx = 0;
    uint8_t count = 0;
    uint32_t prev_time = 0;
    uint32_t last_seen = 0;
    float ema = 0;
    float prev_ema = 0;
    bool init = false;

public:
    Tag() = default;
    uint32_t getLastSeen() const;
    void addSample(int8_t rssi);
    int8_t getMedian() const;
    float getEMA() const;
    bool isReady() const;
    bool shouldPublish();
    void reset();
};

#endif
