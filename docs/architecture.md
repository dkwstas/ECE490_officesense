# System Architecture

## Overview
OfficeSense is a Smart Office Presence system that detects user presence and identifies the room where each user is located using Bluetooth Low Energy (BLE) technology. Users carry BLE tags that periodically broadcast pseudonymized identifiers, while BLE scanners installed in different rooms detect these signals and forward the data to a Raspberry Pi for processing.

The system follows a privacy-by-design approach by using identifiers instead of personal data during communication. In addition to BLE-based presence detection, a camera connected to the Raspberry Pi performs face-recognition-based authentication to verify that the detected BLE tag belongs to the actual user.

The architecture combines edge computing, real-time processing, and lightweight storage technologies to provide low-latency monitoring, room occupancy tracking, and secure user authentication through real-time dashboards.

## Components
- BLE Tags (Seeed Studio XIAO ESP32-C6)
- BLE Scanners (Waveshare ESP32-S3 Zero)
- USB Camera
- Processing Node (Raspberry Pi)
- Communication (BLE, WiFi, MQTT, HTTP, NGSI-LD)
- Storage (SQLite, Redis, Optional InfluxDB)
- Dashboard (Node-RED, AdminJS, Optional Grafana)

## Data Flow
1. A BLE tag periodically broadcasts a pseudonymized UUID.
2. Nearby BLE scanners receive the signal and measure RSSI values.
3. The scanners:
     - validate UUIDs,
     - apply EMA filtering to RSSI values,
     - cache validation responses,
     - package the data and publish to the MQTT broker over WiFi.
4. The Raspberry Pi receives MQTT messages and processes them.
5. The system estimates the user’s room based on strongest RSSI values.
6. When a new presence event occurs:
    - the camera is triggered,
    - image frames are captured,
    - the face recognition service verifies the user identity.
7. The system compares:
    - BLE tag identity
    - face recognition identity
8. The authentication result and room location are stored in Redis.
9. Persistent information is stored in SQLite.
10. Backend APIs provide data to dashboards for real-time visualization.
11. If no BLE signal is received for a predefined timeout period, the user is automatically marked as absent.

## Decisions and Tradeoffs
- Edge Computing with Raspberry Pi
  - Reduces latency
  - Minimizes cloud dependency
  - Improves privacy and reliability
- Hybrid Storage Architecture
  - SQLite for reliable persistent storage
  - Redis for fast real-time operations
- Event-Driven Processing
  - BLE detections trigger processing only when needed
  - Reduces unnecessary computation
- Privacy-by-Design
  - Uses pseudonymized UUIDs instead of direct user identities
- MQTT Communication
  - Lightweight and suitable for IoT environments
  - Supports asynchronous communication

- RSSI-based localization is less accurate than more advanced positioning systems
- Face recognition increases security but also adds computational overhead

## Validation Plan
Describe how you will test the system.
