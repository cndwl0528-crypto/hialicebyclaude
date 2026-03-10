// test/widget_test.dart
// Smoke test for the Hi Alice app

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hi_alice/main.dart';

void main() {
  testWidgets('HiAliceApp smoke test — home screen renders', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: HiAliceApp()));
    await tester.pump();

    expect(find.text('Hi Alice! 👋'), findsOneWidget);
    expect(find.text("Let's explore books together!"), findsOneWidget);
  });
}
