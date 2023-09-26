import { Headers } from 'cross-fetch';

import fetch, { RequestConfig } from './fetch';
import { TabNewsConfig } from './interfaces';
import { Session } from './session';
import { TabNewsApiError } from './commons/interfaces';
import { TabNewsError } from './commons/errors';
import { Content } from './content';
import { User } from './user';

const baseUrl =
  process.env.TABNEWS_BASE_URL || 'https://www.tabnews.com.br/api/v1';

export class TabNews {
  readonly headers: Headers;

  readonly session = new Session(this);
  readonly content = new Content(this);
  readonly user = new User(this);

  constructor(readonly config: Partial<TabNewsConfig> = {}) {
    if (!config.credentials) {
      config.credentials = {};
    }

    config.credentials.email =
      config.credentials.email ?? process.env.TABNEWS_CREDENTIALS_EMAIL;
    config.credentials.password =
      config.credentials.password ?? process.env.TABNEWS_CREDENTIALS_PASSWORD;

    this.headers = new Headers({
      'Content-Type': 'application/json',
    });
  }

  async fetchRequest<T>(
    path: string,
    { body, ...options }: Omit<RequestConfig, 'path'> = {},
  ) {
    const isCreateSession =
      path.includes('/sessions') && 'POST' === options.method;

    const shouldRenovateSession =
      !isCreateSession &&
      this.isCredentialsConfigured() &&
      this.session.hasSession();

    if (shouldRenovateSession) {
      // TODO add a better solution later
      const session = this.session.isExpired()
        ? await this.session.create()
        : this.session.session;
      if (session) {
        this.headers.set('Cookie', `session_id=${session.token}`);
      }
    }

    const response = await fetch(`${baseUrl}${path}`, {
      headers: this.headers,
      body,
      ...options,
    });

    if (!response.ok) {
      const error: TabNewsApiError = await response.json();
      throw new TabNewsError(error);
    }

    return {
      status: response.status,
      headers: response.headers,
      body: (await response.json()) as T,
    };
  }

  async get<T>({ path, ...options }: RequestConfig) {
    const requestOptions = {
      method: 'GET',
      ...options,
    };

    return await this.fetchRequest<T>(path, requestOptions);
  }

  async post<T>({ path, body, ...options }: RequestConfig) {
    const requestOptions = {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    };

    return await this.fetchRequest<T>(path, requestOptions);
  }

  async delete<T>({ path, body, ...options }: RequestConfig) {
    const requestOptions = {
      method: 'DELETE',
      body: JSON.stringify(body),
      ...options,
    };

    return await this.fetchRequest<T>(path, requestOptions);
  }

  private isCredentialsConfigured() {
    return (
      !!this.config.credentials?.email && !!this.config.credentials?.password
    );
  }
}
