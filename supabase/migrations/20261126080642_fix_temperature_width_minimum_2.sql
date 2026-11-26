begin;

alter table public.shipments
  drop constraint shipments_check1,
  add constraint shipments_temp_minimum_width_2_check
    check (temp_max - temp_min >= 2);

-- The original configuration CHECK combined width with bounds and half-degree steps.
alter table public.temperature_config_versions
  drop constraint temperature_config_versions_range,
  add constraint temperature_config_versions_range_minimum_width_2_check check (
    -25 <= target_min and target_min < target_max and target_max <= -15
    and target_max - target_min >= 2
    and target_min * 2 = trunc(target_min * 2)
    and target_max * 2 = trunc(target_max * 2)
  );

commit;
