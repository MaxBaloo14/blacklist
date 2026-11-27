-- 0027 : les catégories de la liste des véhicules autorisés deviennent des catégories valides (réglage « vehicle_classes »).
-- On AJOUTE aux catégories existantes (rien n'est retiré) ; la liste « forbidden_vehicle_classes » reste inchangée.
update settings
set value = (
  select to_jsonb(array(
    select distinct c from unnest(
      array(select jsonb_array_elements_text(settings.value)) ||
      array['Compactes','Berlines','Coupés','Sportives','Sportives Classiques','Grosse cylindrées','Lowrider','Drift','Rallye','SUV','Vans']
    ) as c
  ))
), updated_at = now()
where key = 'vehicle_classes';
