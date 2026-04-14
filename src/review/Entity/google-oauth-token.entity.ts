import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

@Entity('google_oauth_tokens')
@Index(['clinicId'], { unique: true }) // one Google connection per clinic
export class GoogleOauthToken {
    @PrimaryGeneratedColumn()
    id: number;

    // Your internal reference
    @Column()
    clinicId: number;

    // From Google userinfo API
    @Column({ length: 100 })
    googleAccountId: string;

    @Column({ length: 255 })
    googleEmail: string;

    // OAuth tokens
    @Column({ type: 'text' })
    accessToken: string;

    @Column({ type: 'text', nullable: true })
    refreshToken: string | null;

    @Column({ type: 'text' })
    scope: string;

    @Column({ length: 20, default: 'Bearer' })
    tokenType: string;

    // When access token expires
    @Column({ type: 'timestamp' })
    expiryDate: Date;

    // Auditing
    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}