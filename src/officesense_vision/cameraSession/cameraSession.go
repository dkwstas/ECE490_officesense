package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"

	"github.com/Kagami/go-face"
	"github.com/blackjack/webcam"
)

type InputPacket struct {
	UUID       string          `json:"uuid"`
	Descriptor face.Descriptor `json:"descriptor"`
}

type ResultPacket struct {
	UUID     string `json:"uuid"`
	Verified bool   `json:"verified"`
}

var (
	rec     *face.Recognizer
	mtx     sync.Mutex
	results = make([]ResultPacket, 0)
)

func captureCameraFrame() ([]byte, error) {
	cam, err := webcam.Open("/dev/video0")
	if err != nil {
		return nil, err
	}
	defer cam.Close()

	format := webcam.PixelFormat(uint32(0x47504a4d)) // MJPG

	_, _, _, err = cam.SetImageFormat(format, 1280, 720)
	if err != nil {
		return nil, fmt.Errorf("camera format error: %v", err)
	}

	err = cam.StartStreaming()
	if err != nil {
		return nil, err
	}
	defer cam.StopStreaming()

	for {
		err = cam.WaitForFrame(5)
		if err != nil {
			continue
		}

		frame, err := cam.ReadFrame()
		if err != nil {
			return nil, err
		}

		if len(frame) != 0 {
			result := make([]byte, len(frame))
			copy(result, frame)
			return result, nil
		}
	}
}

// verfication thread
func verifyFace(packet InputPacket, descriptors []face.Descriptor, wg *sync.WaitGroup) {
	defer wg.Done()

	const threshold = 0.35

	verified := false

	for _, descriptor := range descriptors {
		distance := face.SquaredEuclideanDistance(packet.Descriptor, descriptor)

		if distance < threshold {
			verified = true
			break
		}
	}

	mtx.Lock()
	results = append(results, ResultPacket{
		UUID:     packet.UUID,
		Verified: verified,
	})
	mtx.Unlock()
}

func main() {
	var err error

	// initialize recognizer
	rec, err = face.NewRecognizer("./models")
	if err != nil {
		log.Fatalf("failed to initialize recognizer: %v", err)
	}
	defer rec.Close()

	// capture image
	cameraImage, err := captureCameraFrame()
	if err != nil {
		log.Fatalf("failed to read camera: %v", err)
	}

	// recognize faces from camera input
	faces, err := rec.RecognizeCNN(cameraImage)
	if err != nil {
		log.Fatalf("recognition error: %v", err)
	}

	if len(faces) == 0 {
		fmt.Println("no face found.")
		return
	}

	var descriptors []face.Descriptor

	// extract descriptors to array
	for _, f := range faces {
		descriptors = append(descriptors, f.Descriptor)
	}

	// read stdin
	scanner := bufio.NewScanner(os.Stdin)
	var wg sync.WaitGroup

	for scanner.Scan() {
		line := scanner.Bytes()

		var packet InputPacket

		err := json.Unmarshal(line, &packet)
		if err != nil {
			log.Printf("invalid json packet: %v", err)
			continue
		}

		wg.Add(1)

		go verifyFace(packet, descriptors, &wg)
	}

	if err := scanner.Err(); err != nil {
		log.Printf("stdin error: %v", err)
	}

	// wait threads to finish
	wg.Wait()

	// print results to stdout
	output, err := json.Marshal(results)
	if err != nil {
		log.Fatalf("failed to marshal results: %v", err)
	}

	fmt.Println(string(output))
}
