all:
	docker buildx build --platform linux/amd64 --cache-from type=local,src=./.docker-cache --cache-to type=local,dest=./.docker-cache --target export --output type=local,dest=./output .

models:
	wget https://github.com/Kagami/go-face-testdata/raw/master/models/shape_predictor_5_face_landmarks.dat
	wget https://github.com/Kagami/go-face-testdata/raw/master/models/dlib_face_recognition_resnet_model_v1.dat
	wget https://github.com/Kagami/go-face-testdata/raw/master/models/mmod_human_face_detector.dat

clean:
	rm -r output/
