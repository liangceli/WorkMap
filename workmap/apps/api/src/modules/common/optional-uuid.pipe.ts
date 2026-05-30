import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class OptionalUuidPipe implements PipeTransform<string | undefined, string | undefined> {
  transform(value: string | undefined) {
    if (!value) {
      return undefined;
    }

    if (!UUID_PATTERN.test(value)) {
      throw new BadRequestException("Expected UUID query parameter.");
    }

    return value;
  }
}
