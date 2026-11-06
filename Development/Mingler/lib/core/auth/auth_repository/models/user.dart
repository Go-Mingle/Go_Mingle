part of 'models.dart';

class User extends Equatable {
  const User({this.id, this.name, this.email});

  factory User.fromEntity(UserEntity entity) {
    return User(
      id: entity.id,
      name: entity.name,
      email: entity.email,
    );
  }

  factory User.fromJson(JsonMap json) {
    return User(
      id: json['id'] as String?,
      name: json['name'] as String?,
      email: json['email'] as String?,
    );
  }

  static const empty = User(id: '0', name: '-', email: '-');

  bool get isEmpty => id == '0';

  bool get isNotEmpty => !isEmpty;

  JsonMap get toJson => {'id': id, 'name': name, 'email': email};

  final String? id;
  final String? name;
  final String? email;

  @override
  List<Object?> get props => [id, name, email];
}
