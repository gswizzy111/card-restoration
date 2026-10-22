-- One-time correction to the stored Terms v1.0, made on 2026-10-22 before
-- anyone had signed it: the owner removed " — attorney review required" from
-- the headings of Sections 18 and 19. terms_versions rows are otherwise
-- permanent; this only changes v1.0 while no signature or order refers to it.
begin;
alter table terms_versions disable trigger terms_versions_immutable;
update terms_versions t
  set content_markdown = replace(t.content_markdown, ' — attorney review required', ''),
      content_sha256 = encode(sha256(convert_to(replace(t.content_markdown, ' — attorney review required', ''), 'UTF8')), 'hex')
  where t.version = '1.0'
    and not exists (select 1 from signatures s where s.terms_version_id = t.id)
    and not exists (select 1 from orders o where o.terms_version_id = t.id);
alter table terms_versions enable trigger terms_versions_immutable;
commit;
