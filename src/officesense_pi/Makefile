build:
	docker build -t officesense:latest .

run:
	docker run --rm -it --init -p 80:80 \
		-e ADMIN_EMAIL=admin@officesense.com \
		-e ADMIN_PASSWORD=supersecret \
		-e ADMIN_COOKIE_SECRET=some-long-random-string \
		-e NODE_ENV=production \
		-e DATABASE_URL=file:/app/data/officesense.sqlite \
		--device /dev/video0:/dev/video0 \
		-v $(shell pwd)/data:/app/data \
		officesense:latest

dev:
	docker run --rm -it --init -p 80:80 \
		-v $(shell pwd):/app \
		-w /app \
		-e ADMIN_EMAIL=admin@officesense.com \
		-e ADMIN_PASSWORD=supersecret \
		-e ADMIN_COOKIE_SECRET=some-long-random-string \
		-e NODE_ENV=development \
		--device /dev/video0:/dev/video0 \
		node:24-slim \
		bash -c "apt-get update && apt-get install -y libdlib19.1 libjpeg62-turbo libblas3 libopenblas0 libatlas3-base liblapack3 && node --run dev"

migrate:
	docker run --rm \
		-e DATABASE_URL=file:/app/data/officesense.sqlite \
		-v $(shell pwd)/data:/app/data \
		officesense:latest \
		npx prisma migrate deploy

sh:
	docker run --rm -it -v $(shell pwd):/app -w /app node:24-slim sh

format:
	docker run --rm -it --init \
		-v $(shell pwd):/app \
		-w /app \
		node:24-slim \
		bash -c "node --run format"

.PHONY: build run dev migrate sh format