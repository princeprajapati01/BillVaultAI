class UserModel {
  final int id;
  final String name;
  final String email;
  final String plan;
  final bool isAdmin;
  final String status;
  final int uploadsUsed;
  final int uploadsLimit;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.plan,
    required this.isAdmin,
    required this.status,
    this.uploadsUsed = 0,
    this.uploadsLimit = 10,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      name: json['name'] ?? 'User',
      email: json['email'] ?? '',
      plan: json['plan'] ?? 'Free',
      isAdmin: json['is_admin'] == true || json['isAdmin'] == true,
      status: json['status'] ?? 'active',
      uploadsUsed: json['uploads_used'] ?? json['uploadsUsed'] ?? 0,
      uploadsLimit: json['uploads_limit'] ?? json['uploadsLimit'] ?? (json['plan'] == 'Free' ? 10 : 1000000),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'plan': plan,
      'is_admin': isAdmin,
      'status': status,
      'uploads_used': uploadsUsed,
      'uploads_limit': uploadsLimit,
    };
  }
}
