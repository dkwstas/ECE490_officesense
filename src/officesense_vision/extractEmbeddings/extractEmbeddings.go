package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"io"

	"os"

	"github.com/Kagami/go-face"
	"golang.org/x/image/draw"
)

type Result struct {
	Success    bool            `json:"success"`
	Descriptor face.Descriptor `json:"descriptor"`
	Error      string          `json:"error"`
}

var res Result

func atExit() {
	resString, err := json.Marshal(res)
	if err != nil {
		os.Exit(1)
	}

	fmt.Println(string(resString))

	os.Exit(0)
}

func resizeIfNeeded(img image.Image, max int) image.Image {
	b := img.Bounds()
	w := b.Dx()
	h := b.Dy()

	if w <= max && h <= max {
		return img
	}

	var scale float64
	if w > h {
		scale = float64(max) / float64(w)
	} else {
		scale = float64(max) / float64(h)
	}

	newW := int(float64(w) * scale)
	newH := int(float64(h) * scale)

	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	draw.BiLinear.Scale(dst, dst.Bounds(), img, b, draw.Over, nil)

	return dst
}

func main() {
	defer atExit()

	// Read input image from stdin in Base64 encoding
	input, err := io.ReadAll(os.Stdin)
	if err != nil {
		res.Success = false
		res.Error = "[STDIN]: " + err.Error()
		return
	}

	// Decode Base64
	image, err := base64.StdEncoding.DecodeString(string(input))
	if err != nil {
		res.Success = false
		res.Error = "[BASE64]: " + err.Error()
		return
	}

	imageJPEG, err := jpeg.Decode(bytes.NewReader(image))
	if err != nil {
		res.Success = false
		res.Error = "[JPEG][DECODE]: " + err.Error()
		return
	}

	imageJPEG = resizeIfNeeded(imageJPEG, 600)

	var buf bytes.Buffer
	err = jpeg.Encode(&buf, imageJPEG, &jpeg.Options{Quality: 90})
	if err != nil {
		res.Success = false
		res.Error = "[JPEG][ENCODE]: " + err.Error()
		return
	}

	image = buf.Bytes()

	// Create recognizer - provide ./models dir
	rec, err := face.NewRecognizer("models")
	if err != nil {
		res.Success = false
		res.Error = "[DLIB][INIT]: " + err.Error()
		return
	}
	defer rec.Close()

	faces, err := rec.RecognizeCNN(image)
	if err != nil {
		res.Success = false
		res.Error = "[DLIB][CNN]: " + err.Error()
		return
	} else if len(faces) == 0 {
		res.Success = false
		res.Error = "[DLIB][CNN]: No face found in image."
		return
	} else if len(faces) != 1 {
		res.Success = false
		res.Error = "[DLIB][CNN]: Multiple faces found in image."
		return
	}

	res.Success = true
	res.Descriptor = faces[0].Descriptor
}
