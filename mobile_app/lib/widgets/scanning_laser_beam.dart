import 'package:flutter/material.dart';
import '../config/app_theme.dart';

class ScanningLaserBeam extends StatefulWidget {
  final double height;
  const ScanningLaserBeam({Key? key, this.height = 250}) : super(key: key);

  @override
  State<ScanningLaserBeam> createState() => _ScanningLaserBeamState();
}

class _ScanningLaserBeamState extends State<ScanningLaserBeam>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(reverse: true);

    _animation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Positioned(
          top: _animation.value * (widget.height - 4),
          left: 0,
          right: 0,
          child: Container(
            height: 4,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [
                  Colors.transparent,
                  AppTheme.primaryCyan,
                  AppTheme.secondaryEmerald,
                  AppTheme.primaryCyan,
                  Colors.transparent,
                ],
              ),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primaryCyan.withOpacity(0.8),
                  blurRadius: 12,
                  spreadRadius: 3,
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
