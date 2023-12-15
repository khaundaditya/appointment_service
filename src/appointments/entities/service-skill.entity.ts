import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'service_skills' })
export class ServiceSkills extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'varchar' })
  skill_name: string;

  @Column({ type: 'varchar' })
  description: string;

  @Column({ type: 'uuid' })
  employee_user_id: string;

  @Column({ type: 'uuid' })
  skill_id: string;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'uuid' })
  updated_by: string;
}
