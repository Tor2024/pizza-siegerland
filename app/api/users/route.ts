import { NextRequest, NextResponse } from 'next/server';
import { getUsers, addUser, findUserByEmail, addOrderToUser, saveUsers } from '@/lib/userStorage';

export async function GET(req: NextRequest) {
  // Check admin auth
  const authHeader = req.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET;
  if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await getUsers();
    return NextResponse.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, phone, address } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

      // Check if user exists
      let user = await findUserByEmail(email);
      
      if (user) {
        // Update user info if provided
        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (address) user.address = address;
        // Save updated user list
        const users = await getUsers();
        const updatedUsers = users.map(u => u.email.toLowerCase() === email.toLowerCase() ? user : u);
        await saveUsers(updatedUsers);
        return NextResponse.json({ success: true, user });
      } else {
        // Create new user
        const newUser = {
          id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          email,
          name: name || '',
          phone: phone || '',
          address: address || '',
          createdAt: Date.now(),
          orders: []
        };
        await addUser(newUser);
        return NextResponse.json({ success: true, user: newUser });
      }
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}