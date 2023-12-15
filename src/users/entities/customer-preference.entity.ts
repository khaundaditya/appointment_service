import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { PreferenceDto } from '../dto/preference.dto';

@Entity({ name: 'customer_preference' })
export class CustomerPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'json' })
  preference: PreferenceDto;

  @Column({ type: 'varchar' })
  customer_user_id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;
}
