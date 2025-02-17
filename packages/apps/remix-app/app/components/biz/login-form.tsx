import React from 'react';
import { Form } from '@remix-run/react';
import { GithubIcon } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card, CardContent } from '~/components/ui/card';

import { cn } from '~/lib/utils';

const Intro: React.FC<{}> = () => {
  return (
    <div className="relative hidden bg-muted md:block">
      <img
        src="/placeholder.svg"
        alt="Image"
        className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
      />
    </div>
  );
};

const Terms: React.FC<{}> = () => {
  return (
    <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
      By clicking continue, you agree to our <a href="#">Terms of Service</a> and{' '}
      <a href="#">Privacy Policy</a>.
    </div>
  );
};

export const LoginForm: React.FC<{
  className?: string;
  onClickOAuth?: () => void;
}> = ({ className, onClickOAuth, ...props }) => {
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card className="overflow-hidden">
        <CardContent className="grid p-0 md:grid-cols-2">
          <Form className="p-6 md:p-8" method="post">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-balance text-muted-foreground">Login to your account</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  name="email"
                  autoComplete="email webauthn"
                  required
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  {/* <a
                    href="#"
                    className="ml-auto text-sm underline-offset-2 hover:underline"
                  >
                    Forgot your password?
                  </a> */}
                </div>
                <Input id="password" name="password" type="password" required />
              </div>
              <Button type="submit" className="w-full">
                Login
              </Button>
              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                <span className="relative z-10 bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <Button type="button" variant="outline" className="w-full" onClick={onClickOAuth}>
                  <GithubIcon />
                  <span className="sr-only">Login with Github</span>
                </Button>
              </div>
            </div>
          </Form>
          <Intro />
        </CardContent>
      </Card>
      <Terms />
    </div>
  );
};

export default LoginForm;
