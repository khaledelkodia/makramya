"use client";

import { ImagePlus } from "lucide-react";

export function CustomerReferenceImageInput(){
  return <label className="upload-field customer-reference-upload">
    <ImagePlus size={19}/>
    <span>صورة مرجعية للطلب (اختياري)<small>JPG أو PNG أو WebP · حتى 5 ميجابايت · الصورة خاصة بالمتجر</small></span>
    <input name="reference_image" type="file" accept="image/jpeg,image/png,image/webp"/>
  </label>;
}
