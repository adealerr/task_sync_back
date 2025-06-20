# Модуль юзера
import { Injectable } from '@nestjs/common';
import { from, map, mergeMap, Observable, tap } from 'rxjs';

import { UserEntity } from '../../entities';
import { ErrorCodes, HttpError } from '../../errors';
import {
  ProfileRepository,
  UserRepository,
  UserToGroupRepository,
  UserToProjectRepository,
} from '../../repositories';
import { ProjectService } from '../project';
import { CreateUser } from './interfaces';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userToProjectRepository: UserToProjectRepository,
    private readonly userToGroupRepository: UserToGroupRepository,
    private readonly profileRepository: ProfileRepository,
    private readonly projectService: ProjectService,
  ) {}

  public create({ email, username }: CreateUser): Observable<UserEntity> {
    return this.checkEmailNotTaken(email).pipe(
      mergeMap(() => this.checkUsernameNotTaken(username)),
      mergeMap(() => this.profileRepository.save({ username, email })),
      mergeMap((profile) => this.userRepository.save({ profile })),
    );
  }

  public get(userId: string): Observable<UserEntity> {
    return this.userRepository.findOne({ id: userId }, { join: ['profile'] });
  }

  public getCurrentProjectOrFail(userId: string) {
    return this.get(userId).pipe(
      mergeMap(({ currentProjectId }) => {
        if (!currentProjectId)
          throw new HttpError('Switch to the project!', ErrorCodes.NO_PROJECT_SELECTED);

        return this.projectService.get(currentProjectId);
      }),
    );
  }

  public getByUsernameOrEmail(usernameOrEmail: string): Observable<UserEntity> {
    const query = 'profile.username = :usernameOrEmail or profile.email = :usernameOrEmail';

    return from(
      this.userRepository
        .getQueryBuilder('user')
        .where(query, {
          usernameOrEmail,
        })
        .leftJoinAndSelect('user.profile', 'profile')
        .getOne(),
    );
  }

  public isMemberOfProject(projectId: string, userId: string): Observable<boolean> {
    return this.userToProjectRepository
      .findOne({ userId, projectId })
      .pipe(map((user2project) => !!user2project));
  }

  public isMemberOfGroup(groupId: string, userId: string): Observable<boolean> {
    return this.userToGroupRepository
      .findOne({ userId, groupId })
      .pipe(map((user2group) => !!user2group));
  }

  public switchProject(projectId: string, userId: string): Observable<void> {
    return this.isMemberOfProject(projectId, userId).pipe(
      mergeMap((isMember) => {
        if (!isMember) throw new HttpError('Is not project member!', ErrorCodes.NOT_MEMBER);

        return this.userRepository
          .update({ id: userId }, { currentProjectId: projectId })
          .pipe(map(() => undefined));
      }),
    );
  }

  private checkEmailNotTaken(email: string): Observable<void> {
    return this.profileRepository.findOne({ email }).pipe(
      tap((profile) => {
        if (profile) throw new HttpError('Email already taken', ErrorCodes.EMAIL_TAKEN);
      }),
      map(() => undefined),
    );
  }

  private checkUsernameNotTaken(username: string): Observable<void> {
    return this.profileRepository.findOne({ username }).pipe(
      tap((profile) => {
        if (profile) throw new HttpError('Username already taken', ErrorCodes.USERNAME_TAKEN);
      }),
      map(() => undefined),
    );
  }
}
