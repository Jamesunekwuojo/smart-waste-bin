class SensorFusionService:
    @staticmethod
    def validate_fusion(fill_percent: float, weight_kg: float, height_cm: float) -> bool:
        """
        Sanity checks the incoming fused fill_percent against raw weight and height readings.
        Returns True if the readings are anomalous (inconsistent), False otherwise.
        """
        # Rule 1: High fill percentage (> 80%) but almost zero weight (< 0.05kg)
        if fill_percent > 80.0 and weight_kg < 0.05:
            return True

        # Rule 2: Low fill percentage (< 5%) but extremely high weight (> 40.0kg)
        if fill_percent < 5.0 and weight_kg > 40.0:
            return True

        # Rule 3: High height (sensor distance empty space > 120cm) but high fill (> 90%)
        # (Assuming typical bin height limits around 100-150cm)
        if height_cm > 120.0 and fill_percent > 90.0:
            return True

        return False
