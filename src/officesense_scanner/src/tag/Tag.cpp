#include <iostream>
#include "Tag.hpp"

uint32_t Tag::getLastSeen() const { return this->last_seen; }

void Tag::addSample(int8_t rssi)
{
#ifdef DEBUG
    Serial.printf("[addSample()]: rssi_window[%d] = %d\n", this->win_idx, rssi);
    Serial.flush();
#endif

    this->rssi_window[this->win_idx] = rssi;
    this->win_idx = (this->win_idx + 1) % 5;

#ifdef DEBUG
    Serial.printf("[addSample()]: count = %d", this->count);
    Serial.flush();
#endif

    if (this->count < 5)
    {
        this->count++;

#ifdef DEBUG
        Serial.printf(" -> %d", this->count);
        Serial.flush();
#endif
    }

#ifdef DEBUG
    Serial.println();
    Serial.flush();
#endif

    int8_t median = getMedian();

#ifdef DEBUG
    Serial.printf("[addSample()]: median = %d\n", median);
    Serial.flush();
#endif

    // EMA update
    if (!this->init)
    {
#ifdef DEBUG
        Serial.printf("[addSample()]: init = false\n");
        Serial.flush();
#endif

        this->ema = median;

#ifdef DEBUG
        Serial.printf("[addSample()]: ema = %f\n", this->ema);
        Serial.flush();
#endif

        this->init = true;
    }
    else
    {
        this->ema = 0.8f * this->ema + 0.2f * median;

#ifdef DEBUG
        Serial.printf("[addSample()]: ema = %f\n", this->ema);
        Serial.flush();
#endif
    }

    last_seen = millis();
}

int8_t Tag::getMedian() const
{
    if (this->count == 0)
    {
#ifdef DEBUG
        Serial.printf("[getMedian()]: count = 0\n");
        Serial.flush();
#endif

        return 0;
    }

    int8_t sorted[5];

#ifdef DEBUG
    Serial.printf("[getMedian()]: rssi_window[] = {");
    Serial.flush();
#endif

    for (uint8_t i = 0; i < this->count; i++)
    {
#ifdef DEBUG
        Serial.printf(" %d", rssi_window[i]);
        Serial.flush();
#endif

        sorted[i] = this->rssi_window[i];
    }

#ifdef DEBUG
    Serial.printf(" }\n");
    Serial.flush();
#endif

    std::sort(sorted, sorted + this->count);

    return sorted[this->count / 2];
}

float Tag::getEMA() const { return this->ema; }

bool Tag::isReady() const { return count == 5; }

bool Tag::shouldPublish()
{
    if (!this->isReady())
    {
#ifdef DEBUG
        Serial.printf("[shouldPublish()]: isReady = false\n");
        Serial.flush();
#endif

        return false;
    }

    uint32_t now = millis();

    uint32_t time_delta = (this->prev_time == 0 ? INTERVAL : now - this->prev_time);
    float ema_delta = std::abs(this->ema - this->prev_ema);

    bool time_trigger = time_delta >= INTERVAL;
    bool ema_trigger = ema_delta >= EMA_THRESHOLD;

#ifdef DEBUG
    Serial.printf("[shouldPublish()]: time_delta = %u\n"
                  "[shouldPublish()]: ema_delta = %f\n"
                  "[shouldPublish()]: time_trigger = %s\n"
                  "[shouldPublish()]: ema_trigger = %s\n",
                  time_delta,
                  ema_delta,
                  (time_trigger ? "true" : "false"),
                  (ema_trigger ? "true" : "false"));
    Serial.flush();
#endif

    if (time_trigger || ema_trigger)
    {
#ifdef DEBUG
        Serial.printf("[shouldPublish()]: return true\n");
        Serial.flush();
#endif

        this->prev_time = now;
        this->prev_ema = this->ema;
        return true;
    }

#ifdef DEBUG
    Serial.printf("[shouldPublish()]: return false\n");
    Serial.flush();
#endif

    return false;
}

void Tag::reset()
{
    this->win_idx = 0;
    this->count = 0;
    this->ema = 0;
    this->init = false;

    for (uint8_t i = 0; i < 5; i++)
        this->rssi_window[i] = 0;
}
