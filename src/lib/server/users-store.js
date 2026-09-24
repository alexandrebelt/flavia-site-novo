export async function getUserByEmail(db, email) {
	return db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
}

export async function getUserById(db, id) {
	return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
}

export async function updateUserPassword(db, id, passwordHash) {
	await db
		.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
		.bind(passwordHash, new Date().toISOString(), id)
		.run();
}
