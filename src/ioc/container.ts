import { Container } from 'inversify';
import 'reflect-metadata';

import { bindToContainers } from './bindings';

export class IocContainer {
  private static _container: Container;

  public static get container(): Container {
    if (!IocContainer._container) {
      IocContainer._container = new Container();
      bindToContainers(IocContainer._container);
    }
    return IocContainer._container;
  }

  public static bindServices(): void {
    // Services are bound automatically through configureContainer
  }
}
