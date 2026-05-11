import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class FreightFairColors {
  static const background = Color(0xFFFFFFFF);
  static const secondaryBackground = Color(0xFFF5F5F5);
  static const cardBackground = Color(0xFFFAFAFA);
  static const primaryText = Color(0xFF1A1A1A);
  static const secondaryText = Color(0xFF6B6B6B);
  static const accent = Color(0xFF00897B);
  static const accentDark = Color(0xFF00695C);
  static const accentLight = Color(0xFFE0F2F1);
  static const error = Color(0xFFE53935);
  static const warning = Color(0xFFFF6B00);
  static const border = Color(0xFFE0E0E0);
}

class FreightFairTheme {
  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: FreightFairColors.accent,
        brightness: Brightness.light,
        primary: FreightFairColors.accent,
        secondary: FreightFairColors.accentDark,
        surface: FreightFairColors.background,
      ),
    );

    return base.copyWith(
      scaffoldBackgroundColor: FreightFairColors.secondaryBackground,
      textTheme: GoogleFonts.dmSansTextTheme(base.textTheme).apply(
        bodyColor: FreightFairColors.primaryText,
        displayColor: FreightFairColors.primaryText,
      ),
      cardTheme: CardThemeData(
        color: FreightFairColors.background,
        elevation: 0,
        shadowColor: Colors.black.withValues(alpha: 0.06),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      dividerTheme: const DividerThemeData(color: FreightFairColors.border, thickness: 1),
      appBarTheme: const AppBarTheme(
        backgroundColor: FreightFairColors.background,
        foregroundColor: FreightFairColors.primaryText,
        elevation: 0,
        centerTitle: false,
        surfaceTintColor: FreightFairColors.background,
        shape: Border(bottom: BorderSide(color: FreightFairColors.border, width: 1)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: FreightFairColors.background,
        hintStyle: const TextStyle(color: FreightFairColors.secondaryText),
        labelStyle: const TextStyle(color: FreightFairColors.secondaryText),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: FreightFairColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: FreightFairColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: FreightFairColors.accent, width: 1.4),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: FreightFairColors.accent,
          foregroundColor: Colors.white,
          elevation: 0,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w700, fontSize: 16),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: FreightFairColors.accentDark,
          side: const BorderSide(color: FreightFairColors.border),
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w700, fontSize: 16),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: FreightFairColors.accentDark,
          textStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w700),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: FreightFairColors.background,
        selectedItemColor: FreightFairColors.accent,
        unselectedItemColor: FreightFairColors.secondaryText,
        type: BottomNavigationBarType.fixed,
        elevation: 10,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: FreightFairColors.background,
        indicatorColor: Colors.transparent,
        iconTheme: MaterialStateProperty.resolveWith((states) {
          final selected = states.contains(MaterialState.selected);
          return IconThemeData(
            size: 22,
            color: selected ? FreightFairColors.accent : FreightFairColors.secondaryText,
          );
        }),
        labelTextStyle: MaterialStateProperty.resolveWith((states) {
          final selected = states.contains(MaterialState.selected);
          return TextStyle(
            fontSize: 10,
            color: selected ? FreightFairColors.accent : FreightFairColors.secondaryText,
            fontWeight: FontWeight.w500,
          );
        }),
      ),
      chipTheme: base.chipTheme.copyWith(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        backgroundColor: FreightFairColors.secondaryBackground,
        selectedColor: FreightFairColors.accentLight,
        labelStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w600),
        side: const BorderSide(color: FreightFairColors.border),
      ),
      tabBarTheme: const TabBarThemeData(
        labelColor: FreightFairColors.accentDark,
        unselectedLabelColor: FreightFairColors.secondaryText,
        indicatorColor: FreightFairColors.accent,
        dividerColor: FreightFairColors.border,
      ),
      iconTheme: const IconThemeData(color: FreightFairColors.primaryText),
    );
  }
}
