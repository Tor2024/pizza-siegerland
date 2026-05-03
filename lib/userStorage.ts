import fs from 'fs';
import path from 'path';

const USERS_FILE = path.join(process.cwd(), 'data/users.json');

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  address?: string;
  createdAt: number;
  orders: string[]; // Array of order IDs
}

// Ensure users file exists
function ensureUsersFile() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
  }
}

// Get all users
export async function getUsers(): Promise<User[]> {
  ensureUsersFile();
  const data = fs.readFileSync(USERS_FILE, 'utf8');
  return JSON.parse(data);
}

// Save all users
export async function saveUsers(users: User[]): Promise<void> {
  ensureUsersFile();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Add new user
export async function addUser(user: User): Promise<void> {
  const users = await getUsers();
  users.push(user);
  await saveUsers(users);
}

// Find user by email
export async function findUserByEmail(email: string): Promise<User | undefined> {
  const users = await getUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

// Add order to user's history
export async function addOrderToUser(email: string, orderId: string): Promise<boolean> {
  const users = await getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return false;
  if (!user.orders) user.orders = [];
  user.orders.push(orderId);
  await saveUsers(users);
  return true;
}