# syntax=docker/dockerfile:1
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/cart-service .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/cart-service /cart-service
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/cart-service"]
