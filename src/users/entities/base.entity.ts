import { UpdateDateColumn, CreateDateColumn } from 'typeorm';

export abstract class BaseEntity {
  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  /*@Column({ type: 'varchar', length: 300 })
  created_by: string;*/

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  modified_at: Date;

  /*@Column({ type: 'varchar', length: 300 })
  modified_by: string;*/
}
