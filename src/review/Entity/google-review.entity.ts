import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { GoogleBusinessLocation } from './google-business-location.entity';

@Entity('google_reviews')
@Index(['reviewId'], { unique: true })
export class GoogleReview {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  reviewId: string;

  @Column({ length: 255 })
  locationId: string;

  @ManyToOne(() => GoogleBusinessLocation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId', referencedColumnName: 'locationId' })
  location: GoogleBusinessLocation;

  @Column({ length: 255, nullable: true })
  reviewerName: string;

  @Column({ length: 50, nullable: true })
  starRating: string;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewCreateTime: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
