export interface AnnotationActor { userId?: string; tenantMember: boolean; roles: readonly string[] }
export function canManageAnnotation(authorId: string, actor: AnnotationActor): boolean {
  return actor.tenantMember && !!actor.userId && (authorId === actor.userId || actor.roles.some(role => role === 'abgeordneter' || role === 'bueroleitung'));
}
export function canResolveAnnotation(actor: AnnotationActor): boolean {
  return actor.tenantMember && !!actor.userId;
}
