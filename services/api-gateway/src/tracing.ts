/**
 * OpenTelemetry bootstrap. Imported FIRST in src/index.ts so auto-instrumentation
 * can hook http/fastify/undici before they're required.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const sdk = new NodeSDK({
    serviceName: 'api-gateway',
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [getNodeAutoInstrumentations()]
  });
  sdk.start();
  process.on('SIGTERM', () => { sdk.shutdown().finally(() => process.exit(0)); });
}
