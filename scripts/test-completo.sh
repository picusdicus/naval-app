#!/bin/bash

# Cargar .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

PREVIEW_URL="https://naval-app-git-feat-extraccio-dac3e7-danielmolino-6348s-projects.vercel.app"
BYPASS_SECRET="$VERCEL_AUTOMATION_BYPASS_SECRET"

echo "=== ESTADO INICIAL ==="
psql "$DATABASE_URL" -c "SELECT origen_externo_id, imagen_url FROM eventos_usuario WHERE origen_externo_id LIKE 'ig-DciM41sD_3r%' ORDER BY origen_externo_id;"

echo ""
echo "=== DISPARANDO WEBHOOK A PREVIEW ==="
curl -X POST "$PREVIEW_URL/api/sync-instagram" \
  -H "Content-Type: application/json" \
  -H "x-vercel-protection-bypass: $BYPASS_SECRET" \
  -d '[{
  "id": "3972794503790591467",
  "type": "Sidecar",
  "shortCode": "DciM41sD_3r",
  "caption": "Llagan nuestras Fiestas Patronales y comienzan las actividades programadas el próximo lunes 31 de agosto a las 21.30h con la actuación de SONIA FAUSTO y su grupo Envaje de Boleros que nos transportarán a las melodías de nuestro pais hermano México.\nEl martes 1 de septiembre, a las 21.30h, tendremos un espectáculo musical para el público infnatil y familiar, SUEÑOS DE PRÍNCIPES Y PRINCESAS, lleno de magia de la mano de los personajes de cuentos infantiles.\nY los días 2 y 3, las Escuelas de Danza de Navalcarnero se subirán al escenrario para ofrecernos su arte y su talento.",
  "hashtags": [],
  "mentions": [],
  "url": "https://www.instagram.com/p/DciM41sD_3r/",
  "commentsCount": 0,
  "firstComment": "",
  "latestComments": [],
  "dimensionsHeight": 1317,
  "dimensionsWidth": 1054,
  "displayUrl": "https://scontent-cdg4-2.cdninstagram.com/v/t39.30808-6/787484332_1399405565714787_2232746921511003609_n.jpg?stp=c0.87.1054.1317a_dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk3Mjc5NDQ4NzE5Nzg2MzE4MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA1NC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Sx-KvBG69tgQ7kNvwFvVQq_&_nc_oc=AdqBaiNVTqsQn-LhOu8CfxoY_JkrywBAPJV2Y5j2FCSDy8K7vo8jM0A_z6MFq-rE9hxnDFVBM6hjcLEBsZGCaRRF&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-cdg4-2.cdninstagram.com&_nc_gid=Vpjmx_BVI6qekUCbfNpMDw&_nc_ss=7a22e&oh=00_AQE2IZdbp3IK9TwFdypDedr4q0djEj6BE-BwW7PyYkXy9w&oe=6A9688FB",
  "images": [
    "https://scontent-cdg4-2.cdninstagram.com/v/t39.30808-6/787484332_1399405565714787_2232746921511003609_n.jpg?stp=c0.87.1054.1317a_dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk3Mjc5NDQ4NzE5Nzg2MzE4MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA1NC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Sx-KvBG69tgQ7kNvwFvVQq_&_nc_oc=AdqBaiNVTqsQn-LhOu8CfxoY_JkrywBAPJV2Y5j2FCSDy8K7vo8jM0A_z6MFq-rE9hxnDFVBM6hjcLEBsZGCaRRF&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-cdg4-2.cdninstagram.com&_nc_gid=Vpjmx_BVI6qekUCbfNpMDw&_nc_ss=7a22e&oh=00_AQE2IZdbp3IK9TwFdypDedr4q0djEj6BE-BwW7PyYkXy9w&oe=6A9688FB",
    "https://scontent-cdg4-2.cdninstagram.com/v/t39.30808-6/786755550_1399405732381437_8208900022380241044_n.jpg?stp=c0.94.784.980a_dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk3Mjc5NDQ4NzU0MTg0NDcwMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuNzg0LnNkci5yZWd1bGFyX3Bob3RvLkMzIn0%3D&_nc_ohc=TT-ecZIzEdwQ7kNvwHurHuk&_nc_oc=AdqWNRpiFyyBXjO2Em-5gTGrOosMdvVCany0qufA07bWPBIbKw-3eW44-hosf4GFwfYPf5UliPeGFfD0-NRRZXVz&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-cdg4-2.cdninstagram.com&_nc_gid=Vpjmx_BVI6qekUCbfNpMDw&_nc_ss=7a22e&oh=00_AQGLzhrkPQoMap0nUzpgxwRZ6no-66tr_h0iPLanB_ir_A&oe=6A966D1A",
    "https://scontent-cdg4-2.cdninstagram.com/v/t39.30808-6/785944595_1399406182381392_5960890271253749010_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk3Mjc5NDQ4NzQ4MzEwNDg2Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Kv3tTx2b37AQ7kNvwGdjb_N&_nc_oc=AdqWAEg8UGEX5qDexKvDj9Nm6HGL1ZBzlC2FNZ31PECGf9NcONygFjp1YuxKXNgiHyEqPkBbV6qX2WaFgN2QMIOI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-cdg4-2.cdninstagram.com&_nc_gid=Vpjmx_BVI6qekUCbfNpMDw&_nc_ss=7a22e&oh=00_AQEbZgXO5NcvZh5K4W7zwqDW2RgjanBK3Sq3gi4LHLxbyA&oe=6A9672E1"
  ],
  "alt": "Photo by Cultura_navalcarnero on August 27, 2026.",
  "likesCount": 2,
  "timestamp": "2026-08-27T07:00:32.000Z",
  "childPosts": [
    {
      "id": "3972794487197863181",
      "type": "Image",
      "displayUrl": "https://scontent-cdg4-2.cdninstagram.com/v/t39.30808-6/787484332_1399405565714787_2232746921511003609_n.jpg?stp=c0.87.1054.1317a_dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk3Mjc5NDQ4NzE5Nzg2MzE4MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA1NC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Sx-KvBG69tgQ7kNvwFvVQq_&_nc_oc=AdqBaiNVTqsQn-LhOu8CfxoY_JkrywBAPJV2Y5j2FCSDy8K7vo8jM0A_z6MFq-rE9hxnDFVBM6hjcLEBsZGCaRRF&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-cdg4-2.cdninstagram.com&_nc_gid=Vpjmx_BVI6qekUCbfNpMDw&_nc_ss=7a22e&oh=00_AQE2IZdbp3IK9TwFdypDedr4q0djEj6BE-BwW7PyYkXy9w&oe=6A9688FB",
      "alt": "Photo by Cultura_navalcarnero on August 27, 2026.",
      "ownerUsername": "cultura_navalcarnero"
    },
    {
      "id": "3972794487541844702",
      "type": "Image",
      "displayUrl": "https://scontent-cdg4-2.cdninstagram.com/v/t39.30808-6/786755550_1399405732381437_8208900022380241044_n.jpg?stp=c0.94.784.980a_dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk3Mjc5NDQ4NzU0MTg0NDcwMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuNzg0LnNkci5yZWd1bGFyX3Bob3RvLkMzIn0%3D&_nc_ohc=TT-ecZIzEdwQ7kNvwHurHuk&_nc_oc=AdqWNRpiFyyBXjO2Em-5gTGrOosMdvVCany0qufA07bWPBIbKw-3eW44-hosf4GFwfYPf5UliPeGFfD0-NRRZXVz&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-cdg4-2.cdninstagram.com&_nc_gid=Vpjmx_BVI6qekUCbfNpMDw&_nc_ss=7a22e&oh=00_AQGLzhrkPQoMap0nUzpgxwRZ6no-66tr_h0iPLanB_ir_A&oe=6A966D1A",
      "alt": "Photo by Cultura_navalcarnero on August 27, 2026.",
      "ownerUsername": "cultura_navalcarnero"
    },
    {
      "id": "3972794487483104862",
      "type": "Image",
      "displayUrl": "https://scontent-cdg4-2.cdninstagram.com/v/t39.30808-6/785944595_1399406182381392_5960890271253749010_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk3Mjc5NDQ4NzQ4MzEwNDg2Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Kv3tTx2b37AQ7kNvwGdjb_N&_nc_oc=AdqWAEg8UGEX5qDexKvDj9Nm6HGL1ZBzlC2FNZ31PECGf9NcONygFjp1YuxKXNgiHyEqPkBbV6qX2WaFgN2QMIOI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-cdg4-2.cdninstagram.com&_nc_gid=Vpjmx_BVI6qekUCbfNpMDw&_nc_ss=7a22e&oh=00_AQEbZgXO5NcvZh5K4W7zwqDW2RgjanBK3Sq3gi4LHLxbyA&oe=6A9672E1",
      "alt": "Photo by Cultura_navalcarnero on August 27, 2026.",
      "ownerUsername": "cultura_navalcarnero"
    }
  ],
  "ownerFullName": "Cultura_navalcarnero",
  "ownerUsername": "cultura_navalcarnero",
  "ownerId": "16084729647",
  "paidPartnership": false,
  "isCommentsDisabled": false,
  "inputUrl": "https://www.instagram.com/cultura_navalcarnero/",
  "originalHeight": 1492,
  "originalWidth": 1054,
  "videoViewCount": null,
  "productType": "carousel_container"
}]'

echo ""
echo "=== ESTADO FINAL ==="
sleep 2
psql "$DATABASE_URL" -c "SELECT origen_externo_id, imagen_url FROM eventos_usuario WHERE origen_externo_id LIKE 'ig-DciM41sD_3r%' ORDER BY origen_externo_id;"
