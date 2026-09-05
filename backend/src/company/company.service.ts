import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/company.dto';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  async get() {
    let company = await this.prisma.company.findFirst();
    if (!company) {
      company = await this.prisma.company.create({
        data: { name: 'My Company', timeZone: 'UTC', workingDays: 'Mon,Tue,Wed,Thu,Fri' },
      });
    }
    return company;
  }

  async update(dto: UpdateCompanyDto) {
    const existing = await this.get();
    return this.prisma.company.update({ where: { id: existing.id }, data: dto });
  }
}
