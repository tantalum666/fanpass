import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";

const fanPassIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/;
const gateCodePattern = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,23}$/;

@Injectable()
export class FanPassIdParamPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (typeof value !== "string" || !fanPassIdPattern.test(value)) {
      throw new BadRequestException("Route id parameter is invalid");
    }
    return value;
  }
}

@Injectable()
export class GateCodeParamPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (
      typeof value !== "string" ||
      value !== value.trim() ||
      !gateCodePattern.test(value)
    ) {
      throw new BadRequestException("Gate route parameter is invalid");
    }
    return value;
  }
}
