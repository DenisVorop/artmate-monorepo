import { Body, Controller, Post } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { ValidateResponse } from "../common/response-validation.interceptor";

import { ContactsService } from "./contacts.service";
import {
  ContactMessageResultDTO,
  CreateContactMessageRequestDTO,
} from "./dto";

@ApiTags("Contacts")
@Controller("contacts")
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @ValidateResponse(ContactMessageResultDTO)
  @Post("messages")
  @ApiOperation({
    summary: "Send contact form message to Telegram",
  })
  @ApiBody({ type: CreateContactMessageRequestDTO })
  @ApiOkResponse({ type: ContactMessageResultDTO })
  createMessage(@Body() request: CreateContactMessageRequestDTO) {
    return this.contactsService.createMessage(request);
  }
}
