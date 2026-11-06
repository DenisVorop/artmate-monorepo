import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import {
  likeSubjectPublications,
  type LikeReader,
  type LikeSubjectPublication,
  type PublishedLikeSubject,
} from "./contracts";

@Injectable()
export class LikeSubjectRegistry {
  private readonly publications: Map<string, LikeSubjectPublication>;

  constructor(
    @Inject(likeSubjectPublications)
    publications: readonly LikeSubjectPublication[],
  ) {
    this.publications = new Map();
    for (const publication of publications) {
      if (
        !/^[a-z][a-z0-9-]{0,63}$/.test(publication.subjectType) ||
        !/^[a-z][a-z0-9_]*_v\d+$/.test(publication.view) ||
        typeof publication.denyOwnerLike !== "boolean" ||
        this.publications.has(publication.subjectType)
      )
        throw new Error("Invalid or duplicate like subject publication");
      this.publications.set(publication.subjectType, publication);
    }
  }

  get(subjectType: string) {
    const publication = this.publications.get(subjectType);
    if (!publication)
      throw new BadRequestException("Unsupported like subject type");
    return publication;
  }

  all() {
    return [...this.publications.values()];
  }

  async read(reader: LikeReader, subjectType: string, ids: readonly string[]) {
    const publication = this.get(subjectType);
    if (!ids.length) return [];
    return reader.$queryRaw<PublishedLikeSubject[]>(Prisma.sql`
      SELECT subject_id AS "subjectId", owner_id AS "ownerId",
             is_public AS "isPublic", is_deleted AS "isDeleted"
      FROM ${Prisma.raw(publication.view)}
      WHERE subject_id IN (${Prisma.join(ids)})
    `);
  }
}
