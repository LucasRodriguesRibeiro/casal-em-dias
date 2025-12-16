import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

const USERS_KEY = 'financas_users_db';
const SESSION_KEY = 'financas_session';

export const authService = {
  // Simulate registering a new user
  register: async (name: string, email: string, password: string): Promise<User> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');

    if (users.find((u: any) => u.email === email)) {
      throw new Error('Este email já está cadastrado.');
    }

    const newUser = {
      id: uuidv4(),
      name,
      email,
      password, // In a real app, never store passwords plain text!
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=047857&color=fff`
    };

    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    // Auto login
    const userSession = { id: newUser.id, name: newUser.name, email: newUser.email, avatar: newUser.avatar };
    localStorage.setItem(SESSION_KEY, JSON.stringify(userSession));

    return userSession;
  },

  // Simulate login
  login: async (email: string, password: string): Promise<User> => {
    await new Promise(resolve => setTimeout(resolve, 800));

    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const user = users.find((u: any) => u.email === email && u.password === password);

    if (!user) {
      throw new Error('Email ou senha inválidos.');
    }

    const userSession = { id: user.id, name: user.name, email: user.email, avatar: user.avatar };
    localStorage.setItem(SESSION_KEY, JSON.stringify(userSession));

    return userSession;
  },



  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  },

  getCurrentUser: (): User | null => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  }
};
