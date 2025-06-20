import { Injectable } from '@nestjs/common';
import { map, mergeMap, Observable } from 'rxjs';

import { SignInArgs, SignUpArgs } from '../../graphqlTypes';
import { CredentialsService } from '../credentials';
import { SessionService } from '../session';
import { UserService } from '../user';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly credentialsService: CredentialsService,
    private readonly sessionService: SessionService,
  ) {}

  public signUp({ credentials, username }: SignUpArgs): Observable<{ email: string }> {
    const { email, password } = credentials;

    return this.userService.create({ email, username }).pipe(
      mergeMap((user) => this.credentialsService.create({ user, email, password })),
      map(() => ({ email })),
    );
  }

  public signIn(input: SignInArgs): Observable<{
    accessToken: string;
  }> {
    const { email, password } = input.credentials;

    return this.credentialsService
      .findByEmailAndPassword({
        email,
        password,
      })
      .pipe(
        mergeMap(({ userId }) => this.sessionService.startSession(userId)),
        map(({ token }) => ({
          accessToken: token,
        })),
      );
  }
}
