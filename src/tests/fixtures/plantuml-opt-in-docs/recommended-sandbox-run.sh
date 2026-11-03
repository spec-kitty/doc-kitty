# Anywhere else
docker run -d --name plantuml -p 127.0.0.1:8091:8080 \
  -e PLANTUML_SECURITY_PROFILE=SANDBOX \
  plantuml/plantuml-server:jetty-v1.2026.9@sha256:065c66adc6728ba6dd353a29d4ada73f8358b68549a0f710c4bf46b43c103618
