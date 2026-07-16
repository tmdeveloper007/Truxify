import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:truxify/models/app_models.dart';
import 'package:truxify/services/invoice_pdf_service.dart';
import 'package:truxify/widgets/invoice/invoice_template.dart';

import '../setup.dart';

HistoryOrderData _buildTestOrder({
  String orderId = 'ORD-1234',
  String? blockchainTxHash = '0xabc123def456',
  String? baseFare = 'Rs 500',
  String? distanceCharge = 'Rs 200',
  String? tollCharge = 'Rs 50',
  String? platformFee = 'Rs 30',
}) {
  return const HistoryOrderData(
    orderId: orderId,
    route: 'Mumbai → Delhi',
    date: '2026-07-15',
    amount: 'Rs 780',
    status: 'Delivered',
    driver: 'Rajesh Kumar',
    truckNumber: 'MH-12-AB-1234',
    timeline: [],
    blockchainTxHash: blockchainTxHash,
    baseFare: baseFare,
    distanceCharge: distanceCharge,
    tollCharge: tollCharge,
    platformFee: platformFee,
  );
}

void main() {
  setUpAll(() async {
    await setupTests();
  });

  group('InvoicePdfService.generatePdfBytes', () {
    test('returns non-empty PDF bytes', () async {
      final order = _buildTestOrder();
      final bytes = await InvoicePdfService.generatePdfBytes(order);

      expect(bytes, isNotEmpty);
    });

    test('returns bytes starting with PDF header', () async {
      final order = _buildTestOrder();
      final bytes = await InvoicePdfService.generatePdfBytes(order);

      final header = String.fromCharCodes(bytes.take(5));
      expect(header, equals('%PDF-'));
    });

    test('handles order with null blockchain hash', () async {
      final order = _buildTestOrder(blockchainTxHash: null);
      final bytes = await InvoicePdfService.generatePdfBytes(order);

      expect(bytes, isNotEmpty);
      final header = String.fromCharCodes(bytes.take(5));
      expect(header, equals('%PDF-'));
    });

    test('handles order with null price fields', () async {
      final order = _buildTestOrder(
        baseFare: null,
        distanceCharge: null,
        tollCharge: null,
        platformFee: null,
      );
      final bytes = await InvoicePdfService.generatePdfBytes(order);

      expect(bytes, isNotEmpty);
      final header = String.fromCharCodes(bytes.take(5));
      expect(header, equals('%PDF-'));
    });
  });

  group('Invoice template', () {
    test('buildInvoicePdf returns a document with pages', () {
      final data = InvoiceData(
        orderId: 'ORD-9999',
        date: '2026-07-15',
        status: 'Delivered',
        pickupAddress: 'Pune',
        dropAddress: 'Nagpur',
        driverName: 'Test Driver',
        truckNumber: 'MH-01-XX-0000',
        baseFare: 'Rs 400',
        distanceCharge: 'Rs 150',
        tollCharge: 'Rs 25',
        platformFee: 'Rs 20',
        total: 'Rs 595',
        blockchainTxHash: '0xdef',
      );

      final doc = buildInvoicePdf(data);
      expect(doc, isNotNull);
      expect(doc.document, isNotNull);
    });

    test('PDF content contains order ID', () {
      final data = InvoiceData(
        orderId: 'ORD-7777',
        date: '2026-01-01',
        status: 'Payment Released',
        pickupAddress: 'Chennai',
        dropAddress: 'Bangalore',
        driverName: 'Kumar',
        truckNumber: 'TN-01-AA-1111',
        total: 'Rs 1000',
      );

      final doc = buildInvoicePdf(data);
      final bytes = doc.save();
      final content = utf8.decode(bytes);

      expect(content, contains('ORD-7777'));
      expect(content, contains('Chennai'));
      expect(content, contains('Bangalore'));
      expect(content, contains('Kumar'));
      expect(content, contains('TN-01-AA-1111'));
    });
  });
}
