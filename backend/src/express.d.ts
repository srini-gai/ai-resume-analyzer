// Global Express type augmentation — extends Request with authUser set by requireAuth middleware
declare namespace Express {
  interface Request {
    authUser?: {
      id: string;
      email: string;
      name: string | null;
      avatar_url: string | null;
      status: string;
      isAdmin: boolean;
    };
  }
}
