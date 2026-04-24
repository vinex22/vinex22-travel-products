import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const sdk = new NodeSDK({
    serviceName: 'notification-service',
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [getNodeAutoInstrumentations()]
  });
  sdk.start();
  process.on('SIGTERM', () => { sdk.shutdown().finally(() => process.exit(0)); });
}
