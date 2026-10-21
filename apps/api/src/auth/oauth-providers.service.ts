import { Injectable } from "@nestjs/common";

@Injectable()
export class OAuthProvidersService {
  public getProviders(): "yandex"[] {
    return ["yandex"];
  }
}
