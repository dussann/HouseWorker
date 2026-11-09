export type Role = 'CUSTOMER' | 'CRAFTSMAN';

export type AuthForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  role: Role;
  city: string;
  categoryIds: number[];
};

export function createEmptyAuthForm(role: Role): AuthForm {
  return {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    role,
    city: '',
    categoryIds: [],
  };
}
