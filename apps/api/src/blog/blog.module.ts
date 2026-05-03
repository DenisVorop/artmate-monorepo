import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

import { AdminBlogController, PublicBlogController } from "./blog.controller";
import { BlogService } from "./blog.service";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [PublicBlogController, AdminBlogController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule {}
